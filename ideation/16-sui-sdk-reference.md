# 16 — Sui SDK Reference for Trustea

Distilled from the Sui TypeScript SDK docs, OpenZeppelin Move migration guide, and OpenZeppelin's critical bug patterns article. Last updated: 2026-06-04.

---

## 1. Programmable Transaction Blocks (PTBs)

PTBs are sequences of commands that execute atomically. If any command fails, the entire transaction rolls back. This is the primary way to compose on-chain operations in the TypeScript SDK.

### Setup

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();
```

### Key Command Types

#### `moveCall` — invoke a Move function

```typescript
const [newCoin] = tx.moveCall({
  target: '0x2::coin::split',
  typeArguments: ['0x2::sui::SUI'],
  arguments: [tx.object('0xCoinId'), tx.pure.u64(1000)],
});
```

Format: `packageId::moduleName::functionName`

#### `transferObjects` — send objects to an address

```typescript
tx.transferObjects([tx.coin({ balance: 1_000_000 })], '0xRecipientAddress');
```

#### `splitCoins` — divide a coin into smaller amounts

```typescript
const [coin1, coin2] = tx.splitCoins('0xMyCoinId', [1_000_000, 2_000_000]);
tx.transferObjects([coin1], '0xAlice');
tx.transferObjects([coin2], '0xBob');
```

Split gas coin (SUI) specifically:

```typescript
const [coin] = tx.splitCoins(tx.gas, [1_000_000_000]);
tx.transferObjects([coin], '0xRecipientAddress');
```

#### `mergeCoins` — combine multiple coins into one

```typescript
tx.mergeCoins('0xCoin1', ['0xCoin2', '0xCoin3']);
```

### Command Chaining (composing PTBs)

Results from one command become inputs for the next — all within one atomic tx:

```typescript
const [nft] = tx.moveCall({
  target: '0xPackageId::nft::mint',
  arguments: [tx.pure.string('My NFT')],
});
tx.transferObjects([nft], '0xRecipientAddress');
```

### Composable PTB Builders (thunks)

Reusable transaction components — pass a function that receives `tx`:

```typescript
function depositToTrust(tx: Transaction, poolId: string, amount: bigint) {
  tx.moveCall({
    target: `${TRUSTEA_PACKAGE_ID}::trust::deposit`,
    arguments: [tx.object(poolId), tx.balance({ balance: amount })],
  });
}
```

---

## 2. Coin Operations for Deposits

### `tx.coin()` — produces a `Coin<T>` object (for transfers)

```typescript
// SUI: 1 SUI = 1_000_000_000 MIST
tx.transferObjects([tx.coin({ balance: 1_000_000_000n })], recipientAddress);

// Other coin types
tx.transferObjects(
  [tx.coin({ balance: 1_000_000n, type: '0xPackageId::module::USDC' })],
  recipientAddress,
);
```

### `tx.balance()` — produces a `Balance<T>` (for Move functions expecting balances)

```typescript
tx.moveCall({
  target: '0xPackage::trust::deposit',
  arguments: [tx.object('0xPoolId'), tx.balance({ balance: 1_000_000_000n })],
});
```

### `coinWithBalance` alias (legacy / convenience)

```typescript
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';

tx.transferObjects([coinWithBalance({ balance: 1_000_000_000 })], recipient);
```

### Coin config options

| Option       | Type               | Default          | Purpose                                              |
|--------------|--------------------|------------------|------------------------------------------------------|
| `balance`    | `bigint \| number` | required         | Amount in base units (MIST for SUI)                  |
| `type`       | `string`           | `0x2::sui::SUI`  | Coin type                                            |
| `useGasCoin` | `boolean`          | `true`           | Splits from gas coin; set `false` for sponsored txns |

### Depositing to address balances (advanced)

```typescript
tx.moveCall({
  target: '0x2::balance::send_funds',
  typeArguments: ['0x2::sui::SUI'],
  arguments: [tx.balance({ balance: 1_000_000_000n }), tx.pure.address('0xRecipientAddress')],
});
```

### Withdrawing from address balances

```typescript
const [coin] = tx.moveCall({
  target: '0x2::coin::redeem_funds',
  typeArguments: ['0x2::sui::SUI'],
  arguments: [tx.withdrawal({ amount: 1_000_000_000 })],
});
tx.transferObjects([coin], '0xRecipientAddress');
```

### Trustea deposit pattern

For depositing SUI into a trust fund:

```typescript
const tx = new Transaction();
// Split the exact deposit amount from the gas coin
const [depositCoin] = tx.splitCoins(tx.gas, [depositAmountMist]);
// Pass as Balance<SUI> into the Move function
tx.moveCall({
  target: `${TRUSTEA_PACKAGE_ID}::trust::deposit`,
  arguments: [tx.object(trustObjectId), tx.object(depositCoin)],
});
```

---

## 3. Querying Objects by Owner

### gRPC client — recommended (replaces JSON-RPC)

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
```

### `listOwnedObjects` — get all objects owned by an address

```typescript
const result = await client.core.listOwnedObjects({
  owner: '0xabc...',
  filter: { StructType: '0x2::coin::Coin<0x2::sui::SUI>' },
  limit: 10,
  cursor: undefined,  // for pagination
});

for (const obj of result.objects) {
  console.log(obj.objectId, obj.type);
}
```

Filter for Trustea trust objects:

```typescript
const result = await client.core.listOwnedObjects({
  owner: userAddress,
  filter: { StructType: `${TRUSTEA_PACKAGE_ID}::trust::TrustCap` },
});
```

### `getObject` — fetch a single object

```typescript
const { object } = await client.core.getObject({
  objectId: '0x123...',
  include: { content: true, previousTransaction: true },
});
```

### `getObjects` — batch fetch

```typescript
const { objects } = await client.core.getObjects({
  objectIds: ['0x123...', '0x456...'],
  include: { content: true },
});
```

### `getBalance` — get balance by address

```typescript
const { balance } = await client.core.getBalance({
  owner: keypair.toSuiAddress(),
});
```

### `listDynamicFields` — query dynamic fields (child objects)

```typescript
const fields = await client.core.listDynamicFields({
  parentId: trustObjectId,
});
```

---

## 4. Event Subscriptions

Event subscription is supported via WebSocket connections. The JSON-RPC API has been deprecated — migrate to gRPC or GraphQL clients.

### Subscription pattern (gRPC streaming)

```typescript
// Subscribe to events emitted by the Trustea package
const subscription = await client.subscribeEvents({
  filter: {
    Package: TRUSTEA_PACKAGE_ID,
  },
  onEvent: (event) => {
    console.log('Event received:', event.type, event.parsedJson);
  },
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Filter options for events

```typescript
// Filter by Move module
{ MoveModule: { package: TRUSTEA_PACKAGE_ID, module: 'trust' } }

// Filter by event type
{ MoveEventType: `${TRUSTEA_PACKAGE_ID}::trust::DepositEvent` }

// Filter by sender
{ Sender: '0xUserAddress...' }
```

### Transaction subscriptions

```typescript
const sub = await client.subscribeTransactions({
  filter: { FromAddress: userAddress },
  onTransaction: (tx) => {
    console.log('New tx:', tx.digest);
  },
});
```

### Practical event pattern for Trustea

Define events in Move contracts, then subscribe in the agent:

```move
// In Move
public struct DepositEvent has copy, drop {
    trust_id: ID,
    depositor: address,
    amount: u64,
}

public fun deposit(trust: &mut Trust, coin: Coin<SUI>, ctx: &mut TxContext) {
    let amount = coin.value();
    // ... deposit logic ...
    event::emit(DepositEvent {
        trust_id: object::id(trust),
        depositor: ctx.sender(),
        amount,
    });
}
```

```typescript
// In TypeScript agent
client.subscribeEvents({
  filter: { MoveEventType: `${TRUSTEA_PACKAGE_ID}::trust::DepositEvent` },
  onEvent: async (event) => {
    const { trust_id, depositor, amount } = event.parsedJson as DepositEvent;
    await notifyBeneficiaries(trust_id, depositor, amount);
  },
});
```

---

## 5. Executing Transactions

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const keypair = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY!);
const client = new SuiGrpcClient({ network: 'testnet' });

const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});

// Wait for finality
await client.waitForTransaction({ digest: result.digest });
```

---

## 6. Critical Sui Move Bug Patterns to Avoid

Source: OpenZeppelin "Critical Bug Patterns in Sui Move" (2024)

---

### Bug 1: Move Reference Pointer Reassignment

**What:** Assigning one reference to another reassigns the pointer — NOT the value. Both references then point to the same field, causing silent corruption.

**Vulnerable:**
```move
let MinterCap { limit, epoch, mut left } = get_cap_mut(treasury, ctx.sender());
left = limit;          // ❌ Both now point to the same field (limit)
*left = *left - amount; // Modifies MinterCap.limit instead of MinterCap.left!
```

**Safe:**
```move
*left = *limit;  // ✅ Dereference both sides to copy the value
```

**Rule:** Always dereference (`*`) when copying a value through references.

---

### Bug 2: Type Parameter Mismatch (Generic Type Confusion)

**What:** Generic types enforce type safety but NOT semantic correctness. A function accepting both a pool type and a user-supplied asset index never validates they correspond.

**Vulnerable:**
```move
public fun withdraw(
    pool: &mut Pool,
    asset: u8,  // ❌ Never validated against pool's actual asset type
    amount: u64,
) { /* ... */ }
```

An attacker provides a BTC pool with a USDC asset index — the contract thinks it's withdrawing one coin while giving the attacker another.

**Safe patterns:**

Option 1 — Assert type matches config:
```move
assert!(type_name::get<CoinType>() == config.coin_type, ETypeMismatch);
```

Option 2 — Derive index from type (never trust user-supplied index):
```move
let asset_type = type_name::get<CoinType>();
let asset_index = storage.index_of(asset_type);
```

Option 3 — Store pool ID in position struct:
```move
public struct Position {
    supply_pool_id: ID,  // ✅ Validate which pool was used at creation
}
assert!(object::id(supply_pool) == position.supply_pool_id, EPoolMismatch);
```

**Rule:** Never trust a user-supplied index or type parameter to match another object. Derive or validate it on-chain.

---

### Bug 3: Overly Permissive Visibility (Access Control)

**What:** Internal helper functions marked `public` (instead of `public(package)`) allow any attacker-deployed module to call them directly, bypassing all protections.

**Vulnerable:**
```move
public fun account_mut(vault: &mut Vault): &mut Account {
    dof::borrow_mut(&mut vault.id, keys::account_key())
}
```

**Safe:**
```move
public(package) fun account_mut(vault: &mut Vault): &mut Account {
    // ✅ Only modules in the same package can call this
    dof::borrow_mut(&mut vault.id, keys::account_key())
}
```

**Rule:** All internal helpers must be `public(package)` or `(friend)`. Use `public` only for functions that should be callable by anyone.

---

### Bug 4: Receipt / Hot Potato ID Not Validated

**What:** Hot potato structs (no `drop`, `copy`, or `store` abilities) guarantee a function is called, but NOT that it's called with matching objects. Receipt IDs stored inside are never checked against the object being modified.

**Vulnerable:**
```move
public fun repay_flash_loan(
    limit_order: &mut LimitOrder,
    target_coin: Coin<SUI>,
    receipt: FlashLoanReceipt,
) {
    let FlashLoanReceipt { order_id: _order_id, amount } = receipt;
    // ❌ _order_id is discarded — never checked against limit_order
    // Attacker borrows from victim's order, repays into their own
}
```

**Safe:**
```move
public fun repay_flash_loan(
    limit_order: &mut LimitOrder,
    target_coin: Coin<SUI>,
    receipt: FlashLoanReceipt,
) {
    let FlashLoanReceipt { order_id, amount } = receipt;
    assert!(order_id == object::id(limit_order), EMismatchedOrder); // ✅
    // ...
}
```

**Rule:** Always validate receipt/hot-potato IDs match the target object. Never discard them with `_`.

---

## 7. OpenZeppelin Move Migration Guide — Key Patterns

Source: moveover.openzeppelin.com (page content was not extractable — minified JS). Below are well-known Move patterns from the OZ migration context:

### Ownership model: objects vs accounts

Move uses an object-centric model. Assets are owned objects, not balances in a mapping. This changes how you think about "who holds what":

- Sui: `Coin<SUI>` is an owned object → transferred directly
- EVM: `balances[address]` is a number in a mapping → updated in place

### Capability pattern (replaces `onlyOwner`)

Instead of `msg.sender` checks, issue an owned capability object:

```move
public struct AdminCap has key { id: UID }

public fun admin_action(cap: &AdminCap, ...) {
    // Possession of cap proves authorization
}
```

For Trustea: issue a `TrustCap` to the trust creator, a `BeneficiaryCap` to each beneficiary.

### Hot potato pattern (replaces reentrancy guards)

Objects without `drop` ability MUST be consumed in the same transaction — guarantees call completion:

```move
public struct FlashLoan { amount: u64 }  // no drop!

public fun borrow(pool: &mut Pool, amount: u64): (Coin<SUI>, FlashLoan) { ... }
public fun repay(pool: &mut Pool, coin: Coin<SUI>, loan: FlashLoan) { ... }
// FlashLoan MUST be passed to repay() — can't be dropped
```

### No reentrancy in Sui (but still validate)

Sui's object model prevents classic reentrancy (objects can't be borrowed twice). However, logical reentrancy via flash loans and cross-module calls is still possible — use the hot potato pattern.

### Events: always emit, never rely on return values

Sui doesn't have EVM-style event logs that external tools universally index. Always emit events explicitly:

```move
event::emit(MyEvent { ... });
```

---

## 8. SDK Client Reference Summary

| Client          | Status      | Best for                          |
|-----------------|-------------|-----------------------------------|
| `SuiGrpcClient` | Recommended | Production use, streaming, speed  |
| `SuiGraphQLClient` | Recommended | Complex queries, filtering      |
| `SuiJsonRpcClient` | Deprecated | Legacy only                     |

### Useful imports

```typescript
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { MIST_PER_SUI } from '@mysten/sui/utils';
import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
```

### Network URLs

```typescript
import { getFullnodeUrl } from '@mysten/sui/client';

const rpcUrl = getFullnodeUrl('testnet'); // 'mainnet' | 'testnet' | 'devnet' | 'localnet'
```

---

## 9. Trustea-Specific Patterns

### Trust fund deposit (full flow)

```typescript
async function depositToTrust(
  client: SuiGrpcClient,
  signer: Ed25519Keypair,
  trustObjectId: string,
  amountSui: number,
) {
  const amountMist = BigInt(amountSui * Number(MIST_PER_SUI));
  const tx = new Transaction();

  // Split deposit amount from gas coin
  const [depositCoin] = tx.splitCoins(tx.gas, [amountMist]);

  // Call the Move deposit function
  tx.moveCall({
    target: `${process.env.TRUSTEA_PACKAGE_ID}::trust::deposit`,
    arguments: [tx.object(trustObjectId), depositCoin],
  });

  const result = await client.signAndExecuteTransaction({ transaction: tx, signer });
  await client.waitForTransaction({ digest: result.digest });
  return result.digest;
}
```

### Querying a user's trust objects

```typescript
async function getUserTrusts(client: SuiGrpcClient, owner: string) {
  const { objects } = await client.core.listOwnedObjects({
    owner,
    filter: { StructType: `${process.env.TRUSTEA_PACKAGE_ID}::trust::TrustCap` },
  });
  return objects;
}
```

### Listening for deposit events

```typescript
function watchDeposits(client: SuiGrpcClient, onDeposit: (event: any) => void) {
  return client.subscribeEvents({
    filter: {
      MoveEventType: `${process.env.TRUSTEA_PACKAGE_ID}::trust::DepositEvent`,
    },
    onEvent: onDeposit,
  });
}
```
