export class ConversationEntity {
  id: string;
  name?: string | null;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}
