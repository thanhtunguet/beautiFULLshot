# Task Completion Checklist

After any code change, run:
```bash
npx tsc --noEmit   # TypeScript type check
npm test            # Run tests
```

No ESLint or formatter is configured — TypeScript compiler serves as the primary static analysis tool.

If changes involve Rust code in `src-tauri/`, also run:
```bash
cargo check --manifest-path src-tauri/Cargo.toml
```
