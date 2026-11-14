
import stripe

from app.config import settings


stripe.api_key = settings.STRIPE_SECRET_KEY

try:
    stripe.Balance.retrieve()

    print("Stripe Sandbox Connection: SUCCESS")

except stripe.error.AuthenticationError:
    print("Stripe Secret Key is invalid")

except stripe.error.StripeError as error:
    print("Stripe API Error:", type(error).__name__)

except Exception as error:
    print("Connection Error:", type(error).__name__)
