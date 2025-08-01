# Dutch Auction Calculator for Tezos with Partial Fill Support

import smartpy as sp

@sp.module  
def main():
    # Order structure for Dutch auction
    order_type = sp.record(
        salt=sp.nat,
        maker=sp.address,
        receiver=sp.address, 
        maker_asset=sp.string,  # "tez" for native token, or token contract address
        making_amount=sp.mutez,
        filled_amount=sp.mutez
    )

    class DutchAuctionCalculator(sp.Contract):
        def __init__(self):
            # Track filled amounts for external order hashes
            self.data.filled_amounts = sp.big_map({}, sp.string, sp.mutez)

        @sp.private
        def calc_price(self, times, start_price, end_price):
            """Calculate current price using Dutch auction mechanism"""
            # Extract start_time and end_time from packed times
            start_time = sp.as_nat(times // (2 ** 64))
            end_time = sp.as_nat(times % (2 ** 64))
            current_time = sp.as_nat(sp.now)
            
            # Clamp current time between start and end
            if current_time <= start_time:
                return start_price
            if current_time >= end_time:
                return end_price
                
            span = sp.as_nat(end_time - start_time)
            
            # Linear interpolation: start_price * (end_time - now) + end_price * (now - start_time) / span
            time_elapsed = sp.as_nat(current_time - start_time)
            price_range = sp.as_nat(sp.to_int(start_price) - sp.to_int(end_price))
            
            if span > 0:
                price_decay = sp.mutez(sp.to_int(price_range) * sp.to_int(time_elapsed) // sp.to_int(span))
                return sp.mutez(sp.to_int(start_price) - sp.to_int(price_decay))
            else:
                return end_price

        @sp.entrypoint
        def get_making_amount(self, params):
            """Calculate making amount for an order with partial fill support"""
            sp.cast(params, sp.record(
                order=order_type,
                offchain_amount=sp.mutez,
                times=sp.nat,
                start_price=sp.mutez,
                end_price=sp.mutez
            ))
            
            # Calculate current price
            current_price = self.calc_price(params.times, params.start_price, params.end_price)
            
            # Calculate available amount (unfilled portion)
            available_amount = sp.mutez(sp.to_int(params.order.making_amount) - sp.to_int(params.order.filled_amount))
            
            # Calculate requested amount based on current price
            if sp.to_int(current_price) > 0:
                requested_amount_int = (sp.to_int(available_amount) * sp.to_int(params.offchain_amount)) // sp.to_int(current_price)
                requested_amount = sp.mutez(requested_amount_int)
                
                # Return minimum of requested and available
                if sp.to_int(requested_amount) <= sp.to_int(available_amount):
                    result = requested_amount
                else:
                    result = available_amount
            else:
                result = sp.mutez(0)
            
            # Store result in contract storage (since SmartPy doesn't have return values)
            self.data.last_calculation_result = result

        @sp.entrypoint
        def get_current_price(self, params):
            """Get current price for auction parameters"""
            sp.cast(params, sp.record(
                times=sp.nat,
                start_price=sp.mutez,
                end_price=sp.mutez
            ))
            
            current_price = self.calc_price(params.times, params.start_price, params.end_price)
            self.data.last_price_result = current_price

        @sp.entrypoint
        def get_remaining_amount(self, order):
            """Get remaining fillable amount for an order"""
            sp.cast(order, order_type)
            
            remaining = sp.mutez(sp.to_int(order.making_amount) - sp.to_int(order.filled_amount))
            self.data.last_remaining_result = remaining

        @sp.entrypoint
        def can_partial_fill(self, params):
            """Check if order can be partially filled"""
            sp.cast(params, sp.record(
                order=order_type,
                requested_amount=sp.mutez
            ))
            
            available = sp.mutez(sp.to_int(params.order.making_amount) - sp.to_int(params.order.filled_amount))
            can_fill = sp.to_int(params.requested_amount) <= sp.to_int(available)
            self.data.last_can_fill_result = can_fill

        @sp.entrypoint  
        def update_filled_amount(self, params):
            """Update filled amount for an order hash (for external tracking)"""
            sp.cast(params, sp.record(
                order_hash=sp.string,
                new_filled_amount=sp.mutez
            ))
            
            self.data.filled_amounts[params.order_hash] = params.new_filled_amount

        @sp.entrypoint
        def get_filled_amount(self, order_hash):
            """Get filled amount for an order hash"""
            sp.cast(order_hash, sp.string)
            
            filled = sp.mutez(0)
            if self.data.filled_amounts.contains(order_hash):
                filled = self.data.filled_amounts[order_hash]
            
            self.data.last_filled_result = filled

        # View entrypoints (for reading data)
        @sp.onchain_view()
        def view_current_price(self, params):
            """View function to get current price"""
            sp.cast(params, sp.record(
                times=sp.nat,
                start_price=sp.mutez,
                end_price=sp.mutez
            ))
            
            return self.calc_price(params.times, params.start_price, params.end_price)

        @sp.onchain_view()
        def view_making_amount(self, params):
            """View function to calculate making amount"""
            sp.cast(params, sp.record(
                order=order_type,
                offchain_amount=sp.mutez,
                times=sp.nat,
                start_price=sp.mutez,
                end_price=sp.mutez
            ))
            
            # Calculate current price
            current_price = self.calc_price(params.times, params.start_price, params.end_price)
            
            # Calculate available amount
            available_amount = sp.mutez(sp.to_int(params.order.making_amount) - sp.to_int(params.order.filled_amount))
            
            # Calculate and return result
            if sp.to_int(current_price) > 0:
                requested_amount_int = (sp.to_int(available_amount) * sp.to_int(params.offchain_amount)) // sp.to_int(current_price)
                requested_amount = sp.mutez(requested_amount_int)
                
                if sp.to_int(requested_amount) <= sp.to_int(available_amount):
                    return requested_amount
                else:
                    return available_amount
            else:
                return sp.mutez(0)

        @sp.onchain_view()
        def view_remaining_amount(self, order):
            """View function to get remaining amount"""
            sp.cast(order, order_type)
            return sp.mutez(sp.to_int(order.making_amount) - sp.to_int(order.filled_amount))

# Test scenarios
@sp.add_test()
def test_dutch_auction():
    scenario = sp.test_scenario("Dutch Auction Calculator", main)
    
    # Initialize contract
    calculator = main.DutchAuctionCalculator()
    scenario += calculator
    
    # Test order
    test_order = sp.record(
        salt=1,
        maker=sp.address("tz1fUef6TuMmNUaHTwT3rYxdAgABCPEpZpD6"),
        receiver=sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"),
        maker_asset="tez",
        making_amount=sp.mutez(1000),
        filled_amount=sp.mutez(200)  # 200 already filled
    )
    
    # Test price calculation
    # times = end_time (64 bits) | start_time (64 bits)
    # For testing: start_time=0, end_time=1000
    test_times = 1000  # This represents end_time=1000, start_time=0
    
    scenario += calculator.get_current_price(sp.record(
        times=test_times,
        start_price=sp.mutez(1000),
        end_price=sp.mutez(500)
    ))
    
    # Test making amount calculation
    scenario += calculator.get_making_amount(sp.record(
        order=test_order,
        offchain_amount=sp.mutez(400),
        times=test_times,
        start_price=sp.mutez(1000),
        end_price=sp.mutez(500)
    ))
    
    # Test remaining amount
    scenario += calculator.get_remaining_amount(test_order)
    
    # Test can partial fill
    scenario += calculator.can_partial_fill(sp.record(
        order=test_order,
        requested_amount=sp.mutez(500)
    ))
    
    # Test view functions
    scenario.verify(calculator.view_remaining_amount(test_order) == sp.mutez(800))
