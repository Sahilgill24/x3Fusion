# HTLC based Escrow contract 

import smartpy as sp

@sp.module
def main():
    class Escrow(sp.Contract):
        def __init__(self,amount):
            self.data.amount = sp.tez(0)                   # Tezos amount in mutez


        @sp.entrypoint
        def initialize_escrow(self,params):
            self.data.amount = params.amount                   # Tezos amount in mutez


        @sp.entrypoint
        def deposit(self):
            assert sp.amount >= self.data.amount
            


        @sp.entrypoint
        def withdraw(self,params):
            sp.send(params.address,self.data.amount)
            

@sp.add_test()
def test():
    scenario = sp.test_scenario("Escrow")
    scenario.h1("Escrow Contract Basic Tests")

    # Test accounts
    alice = sp.test_account("Alice")
    bob   = sp.test_account("Bob")

    # 1) Deploy Escrow with required amount = 1 tez
    initial_amount = sp.tez(1)
    
    escrow = main.Escrow(initial_amount)
    scenario+=escrow
    escrow.deposit(_amount=sp.tez(3))
    escrow.withdraw(address=bob.address)

   