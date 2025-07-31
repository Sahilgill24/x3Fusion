import smartpy as sp


@sp.module
def timelocks():
    """Timelock management for Tezos HTLC Escrow"""
    
    class TimelockStage:
        """Timelock stages for escrow lifecycle"""
        WITHDRAWAL = 0
        CANCELLATION = 1
        EMERGENCY = 2
    
    class Timelocks:
        """Timelock configuration and utilities"""
        
        def __init__(self, withdrawal_timelock, cancellation_timelock):
            self.withdrawal_timelock = withdrawal_timelock    # Timestamp when withdrawal is allowed
            self.cancellation_timelock = cancellation_timelock  # Timestamp when cancellation is allowed
            self.created_at = sp.now                          # Contract creation timestamp
            
            # Validate timelock sequence
            self.validate_timelock_sequence(self.created_at, withdrawal_timelock, cancellation_timelock)
        
        @staticmethod
        def validate_timelock_sequence(current_time, withdrawal_timelock, cancellation_timelock):
            """Validate timelock sequence and timing"""
            assert withdrawal_timelock > current_time, "Withdrawal timelock must be in the future"
            assert cancellation_timelock > current_time, "Cancellation timelock must be in the future"
            assert cancellation_timelock > withdrawal_timelock, "Cancellation must be after withdrawal timelock"
        
        def require_timelock(self, stage):
            """Require specific timelock stage to be reached"""
            current_time = sp.now
            
            if stage == TimelockStage.WITHDRAWAL:
                assert current_time >= self.withdrawal_timelock, "Withdrawal timelock not yet reached"
            elif stage == TimelockStage.CANCELLATION:
                assert current_time >= self.cancellation_timelock, "Cancellation timelock not yet reached"
            elif stage == TimelockStage.EMERGENCY:
                # Emergency requires both timelocks to have passed + additional safety period
                emergency_timelock = self.cancellation_timelock + sp.int(86400)  # +24 hours
                assert current_time >= emergency_timelock, "Emergency timelock not yet reached"
            else:
                assert False, "Invalid timelock stage"
        
        def can_withdraw(self):
            """Check if withdrawal is currently allowed"""
            return sp.now >= self.withdrawal_timelock
        
        def can_cancel(self):
            """Check if cancellation is currently allowed"""
            return sp.now >= self.cancellation_timelock
        
        def can_emergency(self):
            """Check if emergency action is currently allowed"""
            emergency_timelock = self.cancellation_timelock + sp.int(86400)  # +24 hours
            return sp.now >= emergency_timelock
        
        def get_status(self):
            """Get current timelock status as string"""
            current_time = sp.now
            
            if current_time < self.withdrawal_timelock:
                return "pending"
            elif current_time < self.cancellation_timelock:
                return "withdrawal_allowed"
            else:
                return "cancellation_allowed"
        
        def time_until_withdrawal(self):
            """Get time remaining until withdrawal (returns None if already available)"""
            current_time = sp.now
            if current_time >= self.withdrawal_timelock:
                return None
            else:
                return self.withdrawal_timelock - current_time
        
        def time_until_cancellation(self):
            """Get time remaining until cancellation (returns None if already available)"""
            current_time = sp.now
            if current_time >= self.cancellation_timelock:
                return None
            else:
                return self.cancellation_timelock - current_time
        
        def time_until_emergency(self):
            """Get time remaining until emergency action"""
            current_time = sp.now
            emergency_timelock = self.cancellation_timelock + sp.int(86400)  # +24 hours
            if current_time >= emergency_timelock:
                return None
            else:
                return emergency_timelock - current_time
        
        def get_withdrawal_timelock(self):
            """Get withdrawal timelock timestamp"""
            return self.withdrawal_timelock
        
        def get_cancellation_timelock(self):
            """Get cancellation timelock timestamp"""
            return self.cancellation_timelock
        
        def get_created_at(self):
            """Get contract creation timestamp"""
            return self.created_at
