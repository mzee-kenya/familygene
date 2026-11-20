import cors from 'cors';
import express from 'express';
import { config } from './config/env.js';
import './database/connection.js';
import { errorHandler } from './middleware/error-handler.js';
import { ApiError } from './middleware/api-error.js';
import { healthRouter } from './routes/health.js';
import { patientsRouter } from './routes/patients.js';

export const app = express();

app.use(cors({ origin: config.webOrigin }));
app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/patients', patientsRouter);
app.use((_request, _response, next) =>
  next(new ApiError(404, 'NOT_FOUND', 'The requested API route was not found.')),
);
app.use(errorHandler);
