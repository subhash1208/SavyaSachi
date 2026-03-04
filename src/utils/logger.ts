export const Logger = {
  info: (message: string, meta?: object) => {
    if (process.env.NODE_ENV === 'test') return;
    console.log(JSON.stringify({ level: 'INFO', message, ...meta }));
  },
  error: (message: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'ERROR', message, ...meta })),

  critical: (message: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'CRITICAL', message, ...meta })),

  warn: (message: string, meta?: object) => {
    if (process.env.NODE_ENV === 'test') return;
    console.warn(JSON.stringify({ level: 'WARN', message, ...meta }));
  },
};
