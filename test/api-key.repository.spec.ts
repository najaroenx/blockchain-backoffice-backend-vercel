jest.mock('prisma/prisma.service', () => {
  return {
    PrismaService: jest.fn().mockImplementation(() => ({
      apiKey: {
        findMany: jest.fn(),
      },
    })),
  };
});
