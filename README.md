# AI-Powered Personal Assistant Platform

Một nền tảng trợ lý cá nhân thông minh được xây dựng bằng NestJS và TypeScript, sử dụng pnpm monorepo architecture.

## 🚀 Tính năng chính

- **API Backend**: RESTful API được xây dựng với NestJS
- **TypeScript**: Hoàn toàn type-safe với TypeScript
- **Monorepo**: Quản lý dự án với pnpm workspace
- **ESLint**: Code linting và formatting
- **Testing**: Unit testing với Jest

## 📁 Cấu trúc dự án

```
ai/
├── apps/
│   └── api/                 # NestJS API application
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── test/
│       └── package.json
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

## 🛠️ Cài đặt

### Yêu cầu hệ thống

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Cài đặt dependencies

```bash
# Cài đặt tất cả dependencies
pnpm install --frozen-lockfile

# Hoặc cài đặt cho workspace cụ thể
pnpm install --filter api
```

## 🏃‍♂️ Chạy ứng dụng

### Development

```bash
# Chạy API server
cd apps/api
pnpm start:dev

# Hoặc từ root directory
pnpm --filter api start:dev
```

### Production

```bash
# Build ứng dụng
pnpm --filter api build

# Chạy production
pnpm --filter api start:prod
```

## 🧪 Testing

```bash
# Unit tests
pnpm --filter api test

# E2E tests
pnpm --filter api test:e2e

# Test coverage
pnpm --filter api test:cov
```

## 🔧 Scripts có sẵn

```bash
# Linting
pnpm --filter api lint

# Format code
pnpm --filter api format

# Build
pnpm --filter api build
```

## 🌐 API Endpoints

### Base URL

```
http://localhost:3000
```

### Endpoints

- `GET /` - Hello World endpoint
- Thêm các endpoints khác khi phát triển...

## 📝 Quy tắc phát triển

1. **Dependency Management**: Sử dụng `pnpm install --frozen-lockfile` khi setup
2. **Code Style**: Tuân thủ ESLint rules
3. **Testing**: Viết tests cho tất cả tính năng mới
4. **TypeScript**: Đảm bảo type safety 100%

## 🔒 Environment Variables

Tạo file `.env` trong thư mục `apps/api/`:

```env
PORT=3000
NODE_ENV=development
```

## 📚 Công nghệ sử dụng

- **Backend**: NestJS, TypeScript
- **Package Manager**: pnpm
- **Testing**: Jest, Supertest
- **Linting**: ESLint
- **Build**: TypeScript Compiler

## 🚀 Roadmap

- [ ] Authentication & Authorization
- [ ] Database integration
- [ ] API documentation với Swagger
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Monitoring & Logging

## 🤝 Đóng góp

1. Fork dự án
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 🐞 Open Issues

### 1. Incomplete Implementation in `types/index.ts`
- **File:** `packages/utils/src/types/index.ts`
- **Problem:** The file contains placeholder comments such as `// Common type definitions sẽ được implement ở đây` and `// Waiting for user to provide the implementation`. This indicates that some common type definitions are missing and need to be implemented.
- **Impact:** Missing type definitions can lead to type errors or lack of type safety in other parts of the codebase.
- **Suggested Fix:** Implement the required common type definitions as indicated by the comments.

### 2. Incomplete Implementation in `pipes.ts`
- **File:** `packages/utils/src/nestjs/pipes.ts`
- **Problem:** The file starts with comments: `// Validation pipes sẽ được implement ở đây` and `// Waiting for user to provide the implementation`. While some pipes are implemented, the comments suggest that additional validation pipes or logic are expected but not yet provided.
- **Impact:** Missing validation pipes may result in incomplete input validation and potential runtime errors.
- **Suggested Fix:** Review the requirements for validation pipes and implement any missing ones as indicated by the comments.

### 3. No Error Handling for Undefined `validateObject` Return in `validation.ts`
- **File:** `packages/utils/src/validation.ts`
- **Problem:** In the function `validateAndParse`, the code assumes that `validateObject(data, schema)` always returns an object with `valid` and `errors` properties. If `validateObject` returns `undefined` or an unexpected value, this could cause runtime errors.
- **Impact:** Potential for runtime exceptions if `validateObject` does not return the expected structure.
- **Suggested Fix:** Add a check to ensure `validation` is defined and has the expected properties before accessing them.
