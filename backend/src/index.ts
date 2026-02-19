import 'dotenv/config';
import { IoManager } from './managers/IoManager';
import { UserManager } from './managers/UserManager';

const io = IoManager.getIo();

const PORT = Number(process.env.PORT) || 3000;
io.listen(PORT);
console.log(`Server listening on port ${PORT}`);

const userManager = new UserManager();

io.on('connection', (socket) => {

    userManager.addUser(socket);

});
