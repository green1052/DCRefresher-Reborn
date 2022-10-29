export {};

declare global {
  class User {
      nick: string;
      id: string | null;
      ip_data: string;
      icon: string | null;
      type: number;
      __ip: string | null;
  }
}