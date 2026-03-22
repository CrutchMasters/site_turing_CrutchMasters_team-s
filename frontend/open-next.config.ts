import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
    default: {
        override: {
            wrapper: "cloudflare-node",
            converter: "edge",
        },
    },
};

export default config;
```

2. В Cloudflare дашборде в настройках воркера измени **Build command** на:
```
cd frontend && npm install && npx opennextjs-cloudflare build
