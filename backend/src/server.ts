import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initTrackingSocket } from './sockets/trackingSocket';

const app = createApp();
const server = http.createServer(app);

initTrackingSocket(server);

server.listen(env.port, () => {
  console.log(`[CardiRide] API & Socket.IO server running on http://localhost:${env.port}`);
  console.log(`[CardiRide] Fixed Destination: Mapúa University Intramuros (14.5902, 120.9787)`);
});
