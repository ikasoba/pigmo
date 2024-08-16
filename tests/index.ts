import { Pigmo, schema } from "../src/Pigmo.js";
import { $filter, $insert, $update } from "../src/PigmoQuery.js";
import { Sqlite3Engine } from "../src/engines/sqlite3.js";

interface User {
  name: string;
}

const db = await Pigmo.create({
  engine: new Sqlite3Engine({
    path: ":memory:"
  }),
  collections: {
    users: schema<User>({
      primaryKey: "name",
      properties: {
        name: {
          isIndexed: true
        }
      }
    })
  }
})

const users = await db.getCollection("users")

const insertedUsers = await users.exec(
  $insert({
    values: [
      {
        name: "pigmo"
      }
    ]
  })
)

console.log(insertedUsers);

const filteredUsers = await users.exec(
  $filter({
    where: {
      name: {
        $search: "pig"
      }
    },
    max: 1
  })
)

console.log(filteredUsers);

const updatedUsers = await users.exec(
  $update({
    where: {
      name: {
        $search: "pig"
      }
    },
    sets: {
      name: "nyomu"
    }
  })
)

console.log(updatedUsers)
