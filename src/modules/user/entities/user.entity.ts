export class UserEntity {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatar?: string | null;
	bio?: string | null;
	role: string;
	status: string;
	isOnline: boolean;
	emailVerified: boolean;
	lastSeenAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;

	constructor(partial: Partial<UserEntity>) {
		Object.assign(this, partial);
	}
}
