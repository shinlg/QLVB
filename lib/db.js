import sql from 'mssql';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 30,
    min: 5,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise = null;

export async function getDbPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log('Connected to SQL Server');
        return pool;
      })
      .catch((err) => {
        console.error('Database Connection Failed: ', err);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export { sql };