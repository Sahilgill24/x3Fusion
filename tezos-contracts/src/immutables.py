import smartpy as sp


@sp.module
def immutables():
    """Immutable data structures and validation for Tezos HTLC Escrow"""
    
    class EscrowImmutables:
        """Immutable escrow parameters - set once during creation"""
        
        def __init__(self, order_hash, hashlock, maker, taker_evm_address, amount, safety_deposit):
            self.order_hash = order_hash           # 32-byte hex string
            self.hashlock = hashlock               # 32-byte hex string  
            self.maker = maker                     # Tezos address
            self.taker_evm_address = taker_evm_address  # EVM address as hex string
            self.amount = amount                   # Tezos amount in mutez
            self.safety_deposit = safety_deposit   # Safety deposit amount in mutez
            
            # Validate all parameters
            self.validate_order_hash(order_hash)
            self.validate_hashlock(hashlock)
            self.validate_evm_address(taker_evm_address)
            self.validate_amounts(amount, safety_deposit)
        
        @staticmethod
        def validate_order_hash(order_hash):
            """Validate order hash format (32-byte hex string)"""
            assert order_hash != "", "Order hash cannot be empty"
            
            # Remove 0x prefix if present
            cleaned_hash = order_hash[2:] if order_hash.startswith("0x") else order_hash
            
            assert len(cleaned_hash) == 64, "Order hash must be 32 bytes (64 hex characters)"
            
            # Check if all characters are hex
            for char in cleaned_hash:
                assert char.lower() in "0123456789abcdef", "Order hash must contain only hex characters"
        
        @staticmethod
        def validate_hashlock(hashlock):
            """Validate hashlock format (32-byte hex string)"""
            assert hashlock != "", "Hashlock cannot be empty"
            
            # Remove 0x prefix if present
            cleaned_hash = hashlock[2:] if hashlock.startswith("0x") else hashlock
            
            assert len(cleaned_hash) == 64, "Hashlock must be 32 bytes (64 hex characters)"
            
            # Check if all characters are hex
            for char in cleaned_hash:
                assert char.lower() in "0123456789abcdef", "Hashlock must contain only hex characters"
        
        @staticmethod
        def validate_evm_address(address):
            """Validate EVM address format (20-byte hex string)"""
            assert address != "", "EVM address cannot be empty"
            
            # Remove 0x prefix if present
            cleaned_address = address[2:] if address.startswith("0x") else address
            
            assert len(cleaned_address) == 40, "EVM address must be 20 bytes (40 hex characters)"
            
            # Check if all characters are hex
            for char in cleaned_address:
                assert char.lower() in "0123456789abcdef", "EVM address must contain only hex characters"
        
        @staticmethod
        def validate_amounts(amount, safety_deposit):
            """Validate amount values"""
            assert amount > sp.mutez(0), "Amount must be greater than 0"
            assert safety_deposit >= sp.mutez(0), "Safety deposit must be non-negative"
        
        def get_total_required(self):
            """Get total required deposit (amount + safety deposit)"""
            return self.amount + self.safety_deposit
        
        def verify_secret(self, secret):
            """Verify secret against hashlock"""
            secret_hash = sp.blake2b(secret)
            
            # Normalize hashlock (ensure consistent format)
            expected_hash = self.get_normalized_hashlock()
            
            return secret_hash == expected_hash
        
        def get_normalized_hashlock(self):
            """Get normalized hashlock (consistent format for comparison)"""
            # Convert to bytes if it's a hex string
            if self.hashlock.startswith("0x"):
                # Remove 0x and convert hex to bytes
                hex_str = self.hashlock[2:]
                return sp.bytes("0x" + hex_str)
            else:
                return sp.bytes("0x" + self.hashlock)
        
        def get_normalized_order_hash(self):
            """Get normalized order hash"""
            if self.order_hash.startswith("0x"):
                return self.order_hash
            else:
                return "0x" + self.order_hash
        
        def get_normalized_evm_address(self):
            """Get normalized EVM address"""
            if self.taker_evm_address.startswith("0x"):
                return self.taker_evm_address
            else:
                return "0x" + self.taker_evm_address
