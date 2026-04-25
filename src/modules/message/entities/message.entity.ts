export class MessageEntity {
  id: string;
  roomId: string;
  senderId: string;
  content?: string | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}
