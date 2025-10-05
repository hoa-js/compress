## @hoajs/compress

Compress middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/compress --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { compress } from '@hoajs/compress'

const app = new Hoa()
app.use(compress())

app.use(async (ctx) => {
  ctx.res.body = 'Hello, Hoa!'
})

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/compress.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
