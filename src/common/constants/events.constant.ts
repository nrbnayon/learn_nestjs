/**
 * WebSocket event names used across the application.
 * Centralised here to avoid magic strings.
 */
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Auth
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',

  // Chat – client emits
  JOIN_ROOM: 'join:room',
  LEAVE_ROOM: 'leave:room',
  SEND_MESSAGE: 'message:send',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  MESSAGE_REACT: 'message:react',
  MESSAGE_READ: 'message:read',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_EDIT: 'message:edit',

  // Chat – server emits
  NEW_MESSAGE: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',
  ROOM_CREATED: 'room:created',
  ROOM_UPDATED: 'room:updated',
  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVED: 'reaction:removed',
  READ_RECEIPT: 'read:receipt',
  TYPING_INDICATOR: 'typing:indicator',

  // Presence
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  PRESENCE_UPDATE: 'presence:update',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',

  // Friendship
  FRIEND_REQUEST: 'friend:request',
  FRIEND_ACCEPTED: 'friend:accepted',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/**
 * Redis Pub/Sub channel names
 */
export const REDIS_CHANNELS = {
  CHAT_MESSAGE: 'chat:message',
  PRESENCE: 'chat:presence',
  NOTIFICATION: 'chat:notification',
} as const;

export type RedisChannel = (typeof REDIS_CHANNELS)[keyof typeof REDIS_CHANNELS];
