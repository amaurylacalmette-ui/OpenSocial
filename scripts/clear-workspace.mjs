import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  await db.postTarget.deleteMany();
  await db.post.deleteMany();
  await db.followerSnapshot.deleteMany();
  await db.automation.deleteMany();
  await db.chatMessage.deleteMany();
  await db.setting.deleteMany();
  await db.socialAccount.deleteMany();
  console.log('workspace cleared');
}

main().finally(() => db.$disconnect());
