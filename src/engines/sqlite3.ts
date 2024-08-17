import type { Database } from "sqlite3";
import { PigmoEngine, PigmoSchema } from "../Pigmo.js";
import { PigmoCollection } from "../PigmoCollection.js";
import { Instruction, InstructionKind, Query } from "../PigmoQuery.js";

const sqlite3 = (await import("sqlite3")).default;

export interface Sqlite3EngineOptions {
  path: string;
}

const escapeName = (name: string) => '"' + name.replace('"', '""') + '"';

export class Sqlite3Collection<T> implements PigmoCollection<T> {
  constructor(private db: Database, private name: string, private properties: string[]) { }

  queryToExpression<T>(isTopLevel: boolean, expr: string, values: unknown[], query: Query<T>): string {
    if ("$eq" in query) {
      values.push(query.$eq);
      return expr + " = ?"
    } else if ("$ne" in query) {
      values.push(query.$ne);
      return expr + " <> ?"
    } else if ("$lt" in query) {
      values.push(query.$lt);
      return expr + " < ?"
    } else if ("$gt" in query) {
      values.push(query.$gt);
      return expr + " > ?"
    } else if ("$lte" in query) {
      values.push(query.$lte);
      return expr + " <= ?"
    } else if ("$gte" in query) {
      values.push(query.$gte);
      return expr + " >= ?"
    } else if ("$in" in query) {
      values.push(query.$in);
      return expr + " IN ?"
    } else if ("$and" in query) {
      const exprs = [];

      for (const q of query.$and) {
        const qValues = [...values];
        exprs.push("( " + this.queryToExpression(false, expr, qValues, q) + " )");
        values.push(...qValues);
      }

      return exprs.join(" AND ")
    } else if ("$or" in query) {
      const exprs = [];

      for (const q of query.$or) {
        const qValues = [...values];
        exprs.push("( " + this.queryToExpression(false, expr, qValues, q) + " )");
        values.push(...qValues);
      }

      return expr + exprs.join(" OR ")
    } else if ("$regex" in query) {
      values.push(query.$regex.source)

      return expr + " REGEXP ?";
    } else if ("$search" in query) {
      values.push("%" + query.$search.replace("%", "%%") + "%");

      return expr + " LIKE ?";
    } else {
      const exprs = []

      for (const key in query) {
        const qValues: unknown[] = [];
        
        const isNextOperator = typeof query[key] == "object" && query[key] ? Object.keys(query[key])[0].startsWith("$") : false;

        if (isTopLevel) {
          if (this.properties.includes(key)) {
            exprs.push(this.queryToExpression(false, isNextOperator ? `${escapeName(key)}->>'$'` : `${escapeName(key)}`, qValues, query[key] as Query<T[keyof T]>))
          } else {
            qValues.push(key)
            exprs.push(this.queryToExpression(false, isNextOperator ? `data->>?` : `data->?`, qValues, query[key] as Query<T[keyof T]>))
          }
        } else {
          qValues.push(...values, key)
          exprs.push(this.queryToExpression(false, isNextOperator ? expr + " ->> ?" : expr + ` -> ?`, qValues, query[key] as Query<T[keyof T]>));
        }

        values.push(...qValues)
      }

      return expr + exprs.join(" AND ");
    }
  }

  exec(instr: Instruction<T>): Promise<T[]> {
    switch (instr.kind) {
      case InstructionKind.Filter: {
        const values: unknown[] = []
        let sql = "SELECT * FROM " + escapeName("__col_" + this.name) + " WHERE ";

        sql += this.queryToExpression(true, "", values, instr.where);

        if (instr.sortBy) {
          sql += " ORDER BY "

          const orders = []

          for (const key in instr.sortBy) {
            const order = instr.sortBy[key];
            if (order == null) continue;

            orders.push(escapeName(key) + " " + (order == "ASC" ? "ASC" : "DESC"))
          }

          sql += orders.join(", ")
        }

        if (instr.max != null) {
          sql += " LIMIT ?";

          values.push(instr.max);

          if (instr.offset != null) {
            sql += " OFFSET ?";

            values.push(instr.offset);
          }
        }

        return new Promise((resolve, reject) => {
          this.db.all<Record<string, unknown>>(sql, values, (err, rows) => {
            if (err) return reject(err);

            const result = []

            for (const row of rows) {
              const { data, ...others } = row;

              result.push({
                ...JSON.parse("" + data),
                ...Object.fromEntries(this.properties.map(k => [k, JSON.parse("" + others[k])] as const))
              })
            }

            resolve(result);
          })
        })
      }

      case InstructionKind.Insert: {
        const values: unknown[] = []
        let sql = "INSERT INTO " + escapeName("__col_" + this.name) + " VALUES ";

        const rows: string[][] = []

        for (const value of instr.values) {
          if (!(typeof value == "object" && value)) {
            console.error(new Error(`Value ${value} is not object. this value ignored.`));
            continue;
          }

          const row = [];

          for (const property of this.properties) {
            row.push(property in value ? JSON.stringify((value as Record<string, unknown>)[property]) : "null");
          }

          row.unshift(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k]) => !this.properties.includes(k)))));

          rows.push(row);
        }

        const records = []
        for (const row of rows) {
          records.push("( " + row.map(() => "?").join(", ") + " )");
          values.push(...row);
        }

        sql += records.join(", ");

        sql += " RETURNING *";

        return new Promise((resolve, reject) => {
          this.db.run(sql, values, function (err) {
            if (err) return reject(err);

            resolve(instr.values);
          })
        })
      }

      case InstructionKind.Update: {
        const values: unknown[] = []
        let sql = "UPDATE " + escapeName("__col_" + this.name) + " SET ";

        const sets: string[] = []

        for (const property of this.properties) {
          sets.push(escapeName(property) + " = ?");
          values.push(property in instr.sets ? JSON.stringify((instr.sets as Record<string, unknown>)[property]) : "null");
        }

        sql += sets.join(", ");

        sql += " WHERE ";

        sql += this.queryToExpression(true, "", values, instr.where);

        sql += " RETURNING *";

        return new Promise((resolve, reject) => {
          this.db.all<Record<string, string>>(sql, values, (err, rows) => {
            if (err) return reject(err);

            const result = []

            for (const row of rows) {
              const { data, ...others } = row;

              result.push({
                ...JSON.parse("" + data),
                ...Object.fromEntries(this.properties.map(k => [k, JSON.parse("" + others[k])] as const))
              })
            }

            resolve(result);
          })
        })
      }

      case InstructionKind.Upsert: {
        const values: unknown[] = []
        let sql = "INSERT OR REPLACE INTO " + escapeName("__col_" + this.name) + " VALUES ";

        const rows: string[][] = []

        for (const value of instr.values) {
          if (!(typeof value == "object" && value)) {
            console.error(new Error(`Value ${value} is not object. this value ignored.`));
            continue;
          }

          const row = [];

          for (const property of this.properties) {
            row.push(property in value ? JSON.stringify((value as Record<string, unknown>)[property]) : "null");
          }

          row.unshift(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k]) => !this.properties.includes(k)))));

          rows.push(row);
        }

        const records = []
        for (const row of rows) {
          records.push("( " + row.map(() => "?").join(", ") + " )");
          values.push(...row);
        }

        sql += records.join(", ");
        
        sql += " RETURNING *";

        return new Promise((resolve, reject) => {
          this.db.all<Record<string, string>>(sql, values, (err) => {
            if (err) return reject(err);

            resolve(instr.values);
          })
        })
      }
        
      case InstructionKind.Remove: {
        const values: unknown[] = []
        let sql = "DELETE FROM " + escapeName("__col_" + this.name) + " WHERE ";

        sql += this.queryToExpression(true, "", values, instr.where);

        sql += " RETURNING *";

        return new Promise((resolve, reject) => {
          this.db.all<Record<string, string>>(sql, values, (err, rows) => {
            if (err) return reject(err);

            const result = []
            
            for (const row of rows) {
              const { data, ...others } = row;

              result.push({
                ...JSON.parse("" + data),
                ...Object.fromEntries(this.properties.map(k => [k, JSON.parse("" + others[k])] as const))
              })
            }
            
            resolve(result);
          })
        })
      }
    }
  }
}

export class Sqlite3Engine implements PigmoEngine {
  private db: Database;

  constructor(options: Sqlite3EngineOptions) {
    this.db = new sqlite3.Database(options.path);


    this.db.serialize(() => {
      this.db.exec("CREATE TABLE IF NOT EXISTS __pigmo_schemas ( name PRIMARY KEY, schema );");
    })
  }

  async createCollection<T>(name: string, schema: PigmoSchema<T>): Promise<void> {
    this.db.serialize(() => {
      let sql = `CREATE TABLE ${escapeName("__col_" + name)}(data`;

      for (const key in schema.properties) {
        sql += ", " + escapeName(key);

        if (schema.primaryKey == key) {
          sql += "PRIMARY KEY"
        }
      }

      sql += ")"

      this.db.exec(sql);

      sql = "";

      for (const key in schema.properties) {
        if (schema.properties?.[key]?.isIndexed) {
          this.db.exec(`CREATE INDEX ${escapeName("__idx_" + name)} ON ${escapeName("__col_" + name)} (${escapeName(key)})`);
        }
      }

      this.db.run("INSERT INTO __pigmo_schemas VALUES (?, ?)", name, JSON.stringify(schema));
    })
  }

  hasCollection(name: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      this.db.all("SELECT * FROM __pigmo_schemas WHERE name = ? LIMIT 1", name, (err, rows) => {
        if (err) return reject(err);

        resolve(rows.length > 0);
      });
    });
  }

  async deleteCollection(name: string): Promise<void> { }

  getCollectionSchema<T>(name: string): Promise<PigmoSchema<T> | null> {
    return new Promise((resolve, reject) => {
      this.db.all<{ schema: string }>("SELECT * FROM __pigmo_schemas WHERE name = ? LIMIT 1", name, (err, rows) => {
        if (err) reject(err);

        if (rows.length <= 0) return resolve(null);

        resolve(JSON.parse(rows[0].schema))
      })
    })
  }

  async getCollection<T>(name: string): Promise<PigmoCollection<T> | null> {
    const schema = await this.getCollectionSchema(name);
    if (schema == null) return null;

    const properties = Object.entries(schema.properties ?? {}).filter(([_, v]) => v != null).map(([k]) => k);

    return new Sqlite3Collection(this.db, name, properties);
  }

  updateCollectionSchema<T>(name: string, schema: PigmoSchema<T>): Promise<PigmoSchema<T> | null> {
    return new Promise(async (resolve, reject) => {
    const prevSchema = (await this.getCollectionSchema<T>(name));
    if (prevSchema == null) return resolve(null);
      
    this.db.serialize(() => {
      let sqls = [];

      const newProperties = Object.keys(schema.properties ?? {}).filter(k => (schema.properties as Record<string,unknown>)[k] != null);

      for (const key in prevSchema.properties) {
        if (!newProperties.includes(key)) {
          // TODO: この構文は sqlite ではサポートされてないので後でやる
          // if (prevSchema.primaryKey == key) {            
          //   sqls.push(`ALTER TABLE ${escapeName("__col_" + name)} DROP PRIMARY KEY`);
          // }
          
          sqls.push(`ALTER TABLE ${escapeName("__col_" + name)} DROP ${escapeName(key)}`);

          if (!schema.properties?.[key]?.isIndexed) {
            sqls.push(`DROP INDEX ${escapeName("__idx_" + name)}`);
          }
        }
      }
      
      const prevProperties = Object.keys(prevSchema.properties ?? {}).filter(k => (prevSchema.properties as Record<string,unknown>)[k] != null);
      
      for (const key in schema.properties) {
        if (!prevProperties.includes(key)) {
          sqls.push(`ALTER TABLE ${escapeName("__col_" + name)} ADD ${escapeName(key)}`);
          
          if (!prevSchema.properties?.[key]?.isIndexed) {
            sqls.push(`CREATE INDEX ${escapeName("__idx_" + name)} ON ${escapeName("__col_" + name)} (${escapeName(key)})`);
          }
        } else {
          if (prevSchema.properties?.[key]?.isIndexed && !schema.properties[key]?.isIndexed) {
            sqls.push(`CREATE INDEX ${escapeName("__idx_" + name)} ON ${escapeName("__col_" + name)} (${escapeName(key)})`);
          } else if (!prevSchema.properties?.[key]?.isIndexed && schema.properties[key]?.isIndexed) {
            sqls.push(`DROP INDEX ${escapeName("__idx_" + name)}`);
          }
        }
      }

      this.db.exec(sqls.join("; "));

      this.db.all<[string, string]>("UPDATE __pigmo_schemas SET schema = ? WHERE name = ?", [JSON.stringify(schema), name], (err, rows) => {
        if (err) return reject(err);

        if (rows.length <= 0) return resolve(null);

        resolve(JSON.parse(rows[0][1]))
      })
    })
    })
  }
}
