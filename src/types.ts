export interface TokenIdentity {
  provider: "google";
  subject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
}

export interface Item {
  id: string;
  title: string;
  description?: string;
  updatedAt: string;
}
