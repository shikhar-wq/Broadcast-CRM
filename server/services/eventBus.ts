import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {}

export const eventEmitter = new AppEventEmitter();
// Increase listener limit for active connections
eventEmitter.setMaxListeners(100);
