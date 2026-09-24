import { httpServer, port } from './app.js';

httpServer.listen(port, () => console.log(`LabourWelfare running at http://localhost:${port}`));
