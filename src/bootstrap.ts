// Bootstrap order placeholder. Story 1.a.7 implementa boot/shutdown sequence
// explícita (env validation Zod → DB → adapters → server → loop). Por agora
// é um no-op que serve apenas para garantir que o ficheiro existe na árvore
// que stories posteriores assumem (AR-002, AR-037).

export const bootstrap = (): void => {
  /* Story 1.a.7 */
};
