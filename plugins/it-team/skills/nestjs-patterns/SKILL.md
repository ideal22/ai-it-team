---
name: nestjs-patterns
description: NestJS patterns - modules, thin controllers, Zod or class-validator pipes, guards, exception filters, config, Prisma. Use when building or reviewing a NestJS backend or its tests.
---

# NestJS Patterns

Production patterns for modular NestJS backends in strict TypeScript.

## Project structure

```text
src/
├── main.ts
├── app.module.ts
├── common/            # cross-cutting: filters/, guards/, interceptors/, pipes/, decorators/
├── config/            # env schema + typed config
├── prisma/            # PrismaModule + PrismaService
└── modules/
    └── expenses/
        ├── expenses.module.ts
        ├── expenses.controller.ts   # HTTP only: parse, call service, map DTO
        ├── expenses.service.ts      # business rules, authorization by owner
        └── expenses.mapper.ts       # entity -> response DTO (bigint -> string, Date -> ISO)
```

Domain code stays in its feature module; export only providers other modules genuinely need.

## Validation: prefer Zod when the project shares Zod contracts

If request/response schemas already live in a shared Zod package (see `it-team:api-design`), validate with
those schemas directly instead of duplicating them as class-validator DTOs.

**Option A — custom pipe (no extra dependency):**

```ts
import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(422, 'VALIDATION_FAILED',
        result.error.issues.map((i) => ({ path: i.path.map(String).join('.'), code: i.code })));
    }
    return result.data;
  }
}
```

```ts
@Post()
create(
  @CurrentUserId() userId: string,
  @Body(new ZodValidationPipe(CreateExpenseBody)) body: CreateExpenseBody,
) {
  return this.expenses.create(userId, body);
}
```

`AppException` is the project's exception carrying a stable code — see the filter below.

**Option B — `nestjs-zod`:** `createZodDto(schema)` produces DTO classes plus a global
`ZodValidationPipe` and OpenAPI integration. Its API changes between major versions — follow the
docs for the installed version.

**Alternative — class-validator** (when the project does not use Zod):

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

export class CreateExpenseDto {
  @Matches(/^-?\d{1,18}$/) amountMinor!: string;   // money as minor units, never @IsNumber floats
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
```

Avoid `enableImplicitConversion` — it turns the string `"false"` into `true` for boolean fields.
Use explicit `@Type()` / `@Transform()` per field.

## Params

- `ParseUUIDPipe` only when IDs are UUIDs (check which `version` values your Nest release
  accepts before pinning one). For cuid2 or other formats, validate with a Zod schema or regex pipe.
- Never trust `:userId` path params for "my" resources — take the user from the auth context.

## Thin controllers, owning services

```ts
@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, id: string): Promise<ExpenseDto> {
    const row = await this.prisma.expense.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new AppException(404, 'EXPENSE_NOT_FOUND'); // also covers "not yours"
    return toExpenseDto(row);
  }
}
```

- Guards enforce coarse rules (authenticated, role); services enforce resource ownership.
- Controllers never coordinate multi-step writes — the service owns the transaction.
- Return response DTOs, never Prisma entities. `bigint` fields must be mapped to strings:
  `JSON.stringify` throws on `bigint`, and `ClassSerializerInterceptor` does not fix that.

## Auth context

```ts
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ user?: { id: string } }>();
  if (!req.user) throw new AppException(401, 'UNAUTHENTICATED');
  return req.user.id;
});
```

Register the auth guard globally (`APP_GUARD`) and mark public routes with a `@Public()`
metadata decorator, so new routes are protected by default.

## Exception filter: one error envelope

```ts
export class AppException extends HttpException {
  constructor(status: number, readonly code: string, readonly details?: ReadonlyArray<{ path: string; code: string }>) {
    super(code, status);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppException) {
      res.status(exception.getStatus()).json({
        error: { code: exception.code, message: exception.message, details: exception.details },
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({ error: { code: status === 404 ? 'ROUTE_NOT_FOUND' : 'HTTP_ERROR', message: exception.message } });
      return;
    }
    this.logger.error(exception);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal error' } });
  }
}
```

(`Response` here is Express's type: `import type { Response } from 'express'`.) Map Prisma
errors (`P2002`, `P2025`, `P2003`) to `AppException` in services or a dedicated filter — see
`it-team:prisma-patterns`. Clients localize by `code`; `message` is for developers only.

## Config: validate env at boot with Zod

```ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
export type Env = z.infer<typeof EnvSchema>;

ConfigModule.forRoot({ isGlobal: true, validate: (raw) => EnvSchema.parse(raw) });
// inject: constructor(private readonly config: ConfigService<Env, true>) {}
// read:   this.config.get('DATABASE_URL', { infer: true })
```

The app must refuse to boot on invalid config rather than fail on the first request.

## Prisma integration

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }) });
  }
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
```

Call `app.enableShutdownHooks()` in `main.ts` so `onModuleDestroy` runs on SIGTERM. Drop the
adapter argument on older Prisma generators that do not require it.

## Bootstrap

```ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({ origin: allowedOrigins, credentials: true }); // explicit allowlist
  await app.listen(app.get(ConfigService<Env, true>).get('PORT', { infer: true }));
}
void bootstrap();
```

Rate limiting: `@nestjs/throttler` globally, tighter `@Throttle()` on auth/OTP routes, with a
shared store when running multiple instances.

## Testing

```ts
describe('ExpensesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter()); // same globals as production
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('rejects invalid money', async () => {
    const res = await request(app.getHttpServer()).post('/v1/expenses').send({ amountMinor: 12.5 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
```

- Unit-test services with mocked dependencies; e2e-test guards, pipes, and filters.
- Integration tests against a real local Postgres (container) catch what mocks hide.

## Production defaults

- Structured logs with request IDs; never log tokens, passwords, or full financial payloads.
- Health checks (`@nestjs/terminus`) for DB and cache.
- Background jobs/consumers in their own modules, not in controllers.
- Security review: `it-team:appsec-checklist` skill; code review: `code-reviewer` agent.

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
