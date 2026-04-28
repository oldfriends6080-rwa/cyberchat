// Preload entry: guarantees polyfills load before app code
// This file is imported first in index.html to satisfy XMTP/tsyringe requirements

import 'reflect-metadata'
import 'buffer'
import 'process'

console.log('✅ Polyfills loaded: reflect-metadata, buffer, process')
