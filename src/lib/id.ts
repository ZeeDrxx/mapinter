/** Identifiant aléatoire. `crypto.randomUUID` n'existe qu'en contexte sécurisé (https/localhost). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
