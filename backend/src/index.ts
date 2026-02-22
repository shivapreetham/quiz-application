import 'dotenv/config';
import { IoManager } from './managers/IoManager';
import { UserManager } from './managers/UserManager';

const io = IoManager.getIo();

const PORT = Number(process.env.PORT) || 3000;

// Handle port already in use
const server = io.listen(PORT);
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please:`);
    console.error(`   1. Stop the process using port ${PORT}`);
    console.error(`   2. Or set PORT environment variable to a different port`);
    console.error(`   3. Or kill the process: npx kill-port ${PORT}`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.on('listening', () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

const userManager = new UserManager();

io.on('connection', (socket) => {
    userManager.addUser(socket);
});
