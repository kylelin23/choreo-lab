import os
import boto3
import redis
from dotenv import load_dotenv

load_dotenv()

# DynamoDB
dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
users_table = dynamodb.Table(os.environ["DYNAMODB_USERS_TABLE"])

# Redis
redis_client = redis.Redis.from_url(
    os.environ["REDIS_URL"], decode_responses=True)
