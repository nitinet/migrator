#!/usr/bin/env node

import fs from 'fs/promises';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

const dbUrl = process.env.DB_URL as string;
const sqlPath = process.env.SQL_PATH ?? process.cwd();

const sequelize = new Sequelize(dbUrl);

const parent = new Umzug({
  migrations: {
    glob: sqlPath + '/*.up.sql',
    resolve: params => {
      const { context, path } = params;

      if (!path?.endsWith('.sql')) {
        return Umzug.defaultResolver(params);
      }

      return {
        name: params.name,
        up: async () => {
          const buff = await fs.readFile(path);
          return context.query(buff.toString());
        },
        down: async () => {
          // Get the corresponding `.down.sql` file to undo this migration
          const newPath = path.replace('.up.sql', '.down.sql');
          const buff = await fs.readFile(newPath);
          return context.query(buff.toString());
        }
      };
    }
  },
  context: sequelize,
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

const umzug = new Umzug({
  ...parent.options,
  migrations: async ctx => {
    const migrations = Array.from(await parent.migrations(ctx));
    return migrations.sort((a, b) => {
      const aName = a.name.padStart(25, '0');
      const bName = b.name.padStart(25, '0');
      return aName.localeCompare(bName);
    });
  }
});

await umzug.runAsCLI();

export default umzug;
