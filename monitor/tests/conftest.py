import sys
import os

# Add monitor directory to path so we can import monitor_worker
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
