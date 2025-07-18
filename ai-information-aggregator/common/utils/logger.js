const winston = require('winston');

const createLogger = (service) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
    ),
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service }) => {
            return `${timestamp} [${service}] ${level}: ${message}`;
          })
        )
      }),
      new winston.transports.File({ filename: `logs/${service}-error.log`, level: 'error' }),
      new winston.transports.File({ filename: `logs/${service}-combined.log` })
    ]
  });
};

module.exports = createLogger;