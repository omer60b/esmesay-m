# Firestore Security Specification

## Data Invariants
1. All database read and write operations require valid authenticated or authorized application access.
2. Updates to products, assignments, branch statuses, and counts are allowed for all valid users to ensure seamless real-time store stock assignments across all devices and browsers.
3. Timestamp and string size limits must be enforced to protect against payload bloat or Denial of Wallet attacks.

## Test Matrix
1. Invalid document size (>1MB payload) -> Denied
2. Malformed barcode or text string (>500 chars) -> Denied
3. Standard app state sync read/write -> Allowed
