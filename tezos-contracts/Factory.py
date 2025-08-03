import smartpy as sp

Main = sp.io.import_script_from_url("file:EscrowDst.py")

@sp.module
def factoryc():
    import Main
    class EscrowFactory(sp.Contract):
        def __init__(self):
            self.data.escrow_address = sp.address("tz1fUef6TuMmNUaHTwT3rYxdAgABCPEpZpD6")

        @sp.entrypoint
        def create2(self):
            self.data.escrow_address = sp.create_contract(
                main.Escrow,
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

    factory2 = factoryc.EscrowFactory()
    scenario += factory2
    escrow = factory2.create2(_amount = sp.mutez(124))
    
    # Test 1: Initialize escrow with valid timelocks
    scenario.h2("Test 1: Initialize Escrow")
    
    current_time = sp.timestamp(1722470400)  # Aug 1, 2025
    withdrawal_time = current_time.add_seconds(0)  # 30 minutes
    public_withdrawal_time = current_time.add_seconds(3599)  # 1 hour
    cancellation_time = current_time.add_seconds(3600)  # 2 hours


   