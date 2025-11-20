declare module "better-sqlite3" {
  export interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: string) => void;
  }

  export default class Database {
    constructor(path?: string, options?: DatabaseOptions);
    prepare<T = unknown>(sql: string): T;
    close(): void;
  }
}
