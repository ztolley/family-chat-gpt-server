export interface TokenIdentity {
  provider: "google";
  subject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
}
