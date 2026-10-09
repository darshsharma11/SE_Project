export class User {
  userId: number;
  name: string;
  email: string;
  passwordHash: string;
  phone: string;

  constructor(params: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
  }) {
    this.userId = params.userId;
    this.name = params.name;
    this.email = params.email;
    this.passwordHash = params.passwordHash;
    this.phone = params.phone;
  }

  login(): boolean {
    throw new Error("NotImplemented: handled via AuthService and Repositories");
  }

  logout(): void {
    throw new Error("NotImplemented: handled via AuthService and cookie invalidation");
  }
}
