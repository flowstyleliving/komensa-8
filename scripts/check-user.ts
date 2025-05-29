import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          display_name: {
            contains: 'Mister',
            mode: 'insensitive'
          }
        },
        {
          email: {
            contains: 'Mister',
            mode: 'insensitive'
          }
        }
      ]
    },
    select: {
      id: true,
      display_name: true,
      email: true,
      name: true
    }
  })

  console.log('Found users:', JSON.stringify(users, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 