const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const shell = isWindows ? true : false;

// Start backend server
console.log('Starting backend server...');
const backend = spawn(
  isWindows ? 'npm.cmd' : 'npm',
  ['start'],
  { 
    cwd: path.join(__dirname, 'backend'),
    shell,
    stdio: 'inherit'
  }
);

backend.on('error', (error) => {
  console.error('Failed to start backend server:', error);
});

// Start frontend server
console.log('Starting frontend React server...');
const frontend = spawn(
  isWindows ? 'npm.cmd' : 'npm',
  ['start'],
  { 
    cwd: __dirname,
    shell,
    stdio: 'inherit'
  }
);

frontend.on('error', (error) => {
  console.error('Failed to start frontend server:', error);
});

// Handle process termination
process.on('SIGINT', () => {
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
});

console.log('Both servers are starting. Press Ctrl+C to stop both servers.'); 