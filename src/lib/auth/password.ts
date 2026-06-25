import { hash, verify } from "@node-rs/argon2";

// Algorithm defaults to argon2id in @node-rs/argon2 (confirmed at runtime)
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  storedHash: string,
  password: string
): Promise<boolean> {
  return verify(storedHash, password);
}
