## To test this deploy this file in the SmartPy IDE. 

import smartpy as sp

@sp.module
def escrow():
    class Escrow(sp.Contract):
        def __init__(self):
            # Initialize with empty/default values
            self.data.immutables = sp.record(
                order_hash = sp.bytes("0x"),
                hashlock = sp.bytes("0x"),
                maker = sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"),  # Default address
                taker_address = " ",
                amount = sp.mutez(0),
                safety_deposit = sp.mutez(0)
            )
            
            self.data.timelocks = sp.record(
                withdrawal_timelock = sp.timestamp(0),
                public_withdrawal_timelock = sp.timestamp(0),
                cancellation_timelock = sp.timestamp(0),
                created_at = sp.timestamp(0)
            )

            self.data.is_initialized = False
            self.data.is_withdrawn = False
            self.data.is_cancelled = False

        @sp.entrypoint
        def initialize_escrow(self, params):
            """Initialize escrow with immutables and timelocks"""
            # assert not self.data.is_initialized, "Escrow already initialized"
            
            # Validate timelock sequence
            current_time = sp.now
            min_withdrawal_delay = 0  # 30 minutes
            max_timelock_period = 7 * 24 * 3600  # 7 days
            
            assert params.withdrawal_timelock > current_time, "Withdrawal timelock must be in the future"
            assert params.public_withdrawal_timelock > params.withdrawal_timelock, "Invalid timelock sequence"
            assert params.cancellation_timelock > params.public_withdrawal_timelock, "Invalid timelock sequence"
            assert params.withdrawal_timelock >= sp.add_seconds(current_time,min_withdrawal_delay), "Withdrawal timelock too soon"


    
            # Set immutables
            self.data.immutables = sp.record(
                order_hash = params.order_hash,
                hashlock = params.hashlock,
                maker = params.maker,
                taker_address = params.taker_address,
                amount = params.amount,
                safety_deposit = params.safety_deposit
            )
            
            # Set timelocks
            self.data.timelocks = sp.record(
                withdrawal_timelock = params.withdrawal_timelock,
                public_withdrawal_timelock = params.public_withdrawal_timelock,
                cancellation_timelock = params.cancellation_timelock,
                created_at = sp.now
            )
            
            self.data.is_initialized = True

        @sp.entrypoint
        def deposit(self):
            """Deposit funds to escrow"""
            assert self.data.is_initialized, "Escrow not initialized"
            total_required = self.data.immutables.amount + self.data.immutables.safety_deposit
            assert sp.amount >= total_required, "Insufficient deposit amount"

        @sp.entrypoint
        def withdraw(self, params):
            """Withdraw funds with secret during private period"""
            assert self.data.is_initialized, "Escrow not initialized"
            # assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Escrow cancelled"
            # assert sp.now >= self.data.timelocks.withdrawal_timelock, "Withdrawal timelock not met"
            # assert sp.sender == self.data.immutables.maker, "Only maker can withdraw during private period"
            
            # Verify secret against hashlock
            secret_hash = sp.sha256(params.secret)
            assert secret_hash == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer amount to taker address (would need oracle for cross-chain)
            # For now, we'll transfer to maker as placeholder
            sp.send(self.data.immutables.maker, self.data.immutables.amount)
            
            self.data.is_withdrawn = True

        @sp.entrypoint
        def public_withdraw(self, secret):
            """Public withdrawal with secret after public period starts"""
            assert self.data.is_initialized, "Escrow not initialized"
            # assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Escrow cancelled"
            assert sp.now >= self.data.timelocks.public_withdrawal_timelock, "Public withdrawal timelock not met"
            
            # Verify secret against hashlock
            secret_hash = sp.sha256(secret)
            assert secret_hash == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer amount to taker address
            sp.send(self.data.immutables.maker, self.data.immutables.amount)
            
            self.data.is_withdrawn = True

        @sp.entrypoint
        def cancel(self):
            """Cancel escrow and refund maker"""
            assert self.data.is_initialized, "Escrow not initialized"
            assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Already cancelled"
            assert sp.now >= self.data.timelocks.cancellation_timelock, "Cancellation timelock not met"
            
            # Refund maker including safety deposit
            total_refund = self.data.immutables.amount + self.data.immutables.safety_deposit
            sp.send(self.data.immutables.maker, total_refund)
            
            self.data.is_cancelled = True

        @sp.entrypoint  
        def emergency_refund(self):
            """Emergency refund after extended period"""
            assert self.data.is_initialized, "Escrow not initialized"
            assert not self.data.is_withdrawn, "Already withdrawn"
            assert not self.data.is_cancelled, "Already cancelled"

            assert sp.now > sp.add_seconds(self.data.timelocks.created_at,7000)
            
            # Refund maker including safety deposit
            total_refund = self.data.immutables.amount + self.data.immutables.safety_deposit
            sp.send(self.data.immutables.maker, total_refund)
            
            self.data.is_cancelled = True

@sp.module
def main():
    import escrow
    class EscrowFactory(sp.Contract):
        def __init__(self):
            self.data.escrow_address = sp.address("tz1fUef6TuMmNUaHTwT3rYxdAgABCPEpZpD6")

        @sp.entrypoint
        def create2(self):
            self.data.escrow_address = sp.create_contract(
                escrow.Escrow,
                None,
                sp.mutez(123),
                sp.record(
                    immutables=sp.record(order_hash = sp.bytes("0x"),
                                        hashlock = sp.bytes("0x"),
                                        maker = sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"),  # Default address
                                        taker_address = " ",
                                        amount = sp.mutez(0),
                                        safety_deposit = sp.mutez(0)),
                    timelocks = sp.record(withdrawal_timelock = sp.timestamp(0),
                                        public_withdrawal_timelock = sp.timestamp(0),
                                        cancellation_timelock = sp.timestamp(0),
                                        created_at = sp.timestamp(0)),
                    is_initialized = False,
                    is_withdrawn = False,
                    is_cancelled = False,
            ))
            

            
                



@sp.add_test()
def test():
    scenario = sp.test_scenario("Enhanced Escrow with Timelocks")
    scenario.h1("Enhanced Escrow Contract Tests")

    # Test accounts
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

    # Deploy Escrow
    escrowfac = main.EscrowFactory()
    scenario += escrowfac
    escrow = escrowfac.create2()

    
    scenario += escrow

   