import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage to maintain tenant context across asynchronous call chains in Node.js
export const tenantStorage = new AsyncLocalStorage<{ tenantId: string }>();

const rawPrisma = new PrismaClient();

// Multi-tenant client extension that implicitly injects `tenantId`
export const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = tenantStorage.getStore();
        
        // Apply RLS-like logic only if a tenantId is set in the active async store
        if (context?.tenantId) {
          const tenantBoundModels = ['User', 'Class', 'ClassEnrollment', 'Assignment', 'StudentAssignmentProgress'];
          
          if (tenantBoundModels.includes(model)) {
            const anyArgs = args as any;
            
            if (['findMany', 'findUnique', 'findFirst', 'update', 'delete', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              anyArgs.where = anyArgs.where || {};
              anyArgs.where = {
                ...anyArgs.where,
                tenantId: context.tenantId,
              };
            } else if (operation === 'create') {
              anyArgs.data = anyArgs.data || {};
              anyArgs.data = {
                ...anyArgs.data,
                tenantId: context.tenantId,
              };
            }
          }
        }
        
        return query(args);
      },
    },
  },
});

export default prisma;
