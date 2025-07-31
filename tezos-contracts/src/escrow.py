# HTLC Escrow for Tezos - Cross-Chain Extension (Without Timelocks)
# Inspired by EVM Escrow with immutables structure
import smartpy as sp
from immutables import immutables


@sp.module
def main():
    class HTLCEscrow(sp.Contract):
        def __init__(
            self, 
            order_hash,
            hashlock, 
            maker,
            taker_evm_address,
            amount,
            safety_deposit,
            withdrawal_timelock,
            cancellation_timelock
        ):
            # Create and validate immutables
            self.data.immutables = immutables.EscrowImmutables(
                order_hash, hashlock, maker, taker_evm_address, amount, safety_deposit
            )
            
            # Simple timelock values (no complex timelock module)
            self.data.withdrawal_timelock = withdrawal_timelock
            self.data.cancellation_timelock = cancellation_timelock
            self.data.created_at = sp.now
            
            # Mutable state
            self.data.deposited_amount = sp.mutez(0)
            self.data.depositor = sp.address("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU")  # Will be set on first deposit
            self.data.is_withdrawn = False
            self.data.is_cancelled = False
            self.data.revealed_secret = sp.none
            self.data.initialized = False  # Track if escrow has received initial deposit

        @sp.entrypoint
        def initialize_escrow(self):
            """Initialize escrow with deposit (equivalent to 'new' function in NEAR)"""
            assert not self.data.initialized, "Escrow already initialized"
            
            # Validate deposit amount
            required_amount = self.data.immutables.get_total_required()
            assert sp.amount >= required_amount, "Insufficient deposit"
            
            # Update state
            self.data.deposited_amount = sp.amount
            self.data.depositor = sp.sender
            self.data.initialized = True

        @sp.entrypoint
        def withdraw(self, params):
            """Withdraw funds by revealing the secret"""
            assert self.data.initialized, "Escrow not initialized"
            assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Escrow cancelled"
            
            # Verify secret matches hashlock
            assert self.data.immutables.verify_secret(params.secret), "Invalid secret"
            
            # Simple timelock check
            assert sp.now >= self.data.withdrawal_timelock, "Withdrawal timelock not yet reached"
            
            # Update state
            self.data.is_withdrawn = True
            self.data.revealed_secret = sp.some(params.secret)
            
            # Transfer funds to maker
            sp.send(self.data.immutables.maker, self.data.immutables.amount)

        @sp.entrypoint
        def cancel(self):
            """Cancel escrow and return funds"""
            assert self.data.initialized, "Escrow not initialized"
            assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Already cancelled"
            
            # Simple cancellation timelock check
            assert sp.now >= self.data.cancellation_timelock, "Cancellation timelock not yet reached"
            
            # Update state
            self.data.is_cancelled = True
            
            # Refund to depositor
            sp.send(self.data.depositor, self.data.deposited_amount)

        @sp.entrypoint
        def emergency_refund(self):
            """Emergency function for depositor to handle stuck funds"""
            assert self.data.initialized, "Escrow not initialized"
            assert sp.sender == self.data.depositor, "Only depositor can emergency refund"
            
            # Emergency timelock check (24 hours after cancellation timelock)
            emergency_timelock = self.data.cancellation_timelock + sp.int(86400)  # +24 hours
            assert sp.now >= emergency_timelock, "Emergency timelock not yet reached"
            
            # Refund to depositor
            sp.send(self.data.depositor, self.data.deposited_amount)

        # View functions
        @sp.onchain_view()
        def get_order_hash(self):
            return self.data.immutables.get_normalized_order_hash()

        @sp.onchain_view()
        def get_hashlock(self):
            return self.data.immutables.hashlock

        @sp.onchain_view()
        def get_maker(self):
            return self.data.immutables.maker

        @sp.onchain_view()
        def get_taker_evm_address(self):
            return self.data.immutables.get_normalized_evm_address()

        @sp.onchain_view()
        def get_amount(self):
            return self.data.immutables.amount

        @sp.onchain_view()
        def get_safety_deposit(self):
            return self.data.immutables.safety_deposit

        @sp.onchain_view()
        def get_withdrawal_timelock(self):
            return self.data.withdrawal_timelock

        @sp.onchain_view()
        def get_cancellation_timelock(self):
            return self.data.cancellation_timelock

        @sp.onchain_view()
        def get_deposited_amount(self):
            return self.data.deposited_amount

        @sp.onchain_view()
        def get_depositor(self):
            return self.data.depositor

        @sp.onchain_view()
        def is_withdrawn(self):
            return self.data.is_withdrawn

        @sp.onchain_view()
        def is_cancelled(self):
            return self.data.is_cancelled

        @sp.onchain_view()
        def get_revealed_secret(self):
            return self.data.revealed_secret

        @sp.onchain_view()
        def get_created_at(self):
            return self.data.created_at

        @sp.onchain_view()
        def is_active(self):
            """Check if escrow is active (not withdrawn and not cancelled)"""
            return not self.data.is_withdrawn and not self.data.is_cancelled

        @sp.onchain_view()
        def get_status(self):
            """Get current status as string"""
            if self.data.is_withdrawn:
                return "withdrawn"
            elif self.data.is_cancelled:
                return "cancelled"
            elif not self.data.initialized:
                return "uninitialized"
            else:
                return "active"

        @sp.onchain_view()
        def get_timelock_status(self):
            """Get timelock status"""
            current_time = sp.now
            
            if current_time < self.data.withdrawal_timelock:
                return "pending"
            elif current_time < self.data.cancellation_timelock:
                return "withdrawal_allowed"
            else:
                return "cancellation_allowed"

        @sp.onchain_view()
        def can_withdraw_now(self):
            """Check if withdrawal is currently allowed"""
            return sp.now >= self.data.withdrawal_timelock

        @sp.onchain_view()
        def can_cancel_now(self):
            """Check if cancellation is currently allowed"""
            return sp.now >= self.data.cancellation_timelock


@sp.add_test()
def test():
    scenario = sp.test_scenario("HTLC Escrow")
    scenario.h1("HTLC Escrow Test")
    
    # Test accounts
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    
    # Test parameters
    order_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    hashlock = sp.blake2b(sp.bytes("0x01223344"))
    amount = sp.tez(1)
    safety_deposit = sp.tez(0.1)
    withdrawal_timelock = sp.timestamp(100)
    cancellation_timelock = sp.timestamp(200)
    
    # Deploy contract
    escrow = main.HTLCEscrow(
        order_hash=order_hash,
        hashlock=hashlock,
        maker=alice.address,
        taker_evm_address="0x6F1859694601891B7ED021c3Fefd390AB776d5C0",
        amount=amount,
        safety_deposit=safety_deposit,
        withdrawal_timelock=withdrawal_timelock,
        cancellation_timelock=cancellation_timelock
    )
    scenario += escrow
    
    # Initialize escrow with deposit
    scenario.h2("Initialize Escrow")
    escrow.initialize_escrow(_sender=bob, _amount=sp.tez(1.1))
    
    # Test withdrawal with correct secret
    scenario.h2("Withdrawal Test")
    scenario.set_timestamp(150)  # After withdrawal timelock
    escrow.withdraw(secret=sp.bytes("0x01223344"), _sender=alice)
    
    scenario.verify(escrow.is_withdrawn() == True)
