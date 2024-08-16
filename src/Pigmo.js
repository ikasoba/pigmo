export function schema(schema) {
    return schema;
}
export class Pigmo {
    engine;
    cache = {};
    static async create(options) {
        for (const name in options.collections) {
            if (await options.engine.hasCollection(name)) {
                await options.engine.updateCollectionSchema(name, options.collections[name]);
            }
            else {
                await options.engine.createCollection(name, options.collections[name]);
            }
        }
        return new Pigmo(options);
    }
    constructor(options) {
        this.engine = options.engine;
    }
    async getCollection(name) {
        const collection = this.cache[name] ?? await this.engine.getCollection(name);
        if (collection == null) {
            throw new Error(`Collection ${name} is not exists.`);
        }
        this.cache[name] = collection;
        return collection;
    }
}
