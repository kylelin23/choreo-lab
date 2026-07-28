import os
import boto3
import redis
from dotenv import load_dotenv

load_dotenv()

# DynamoDB
dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
users_table = dynamodb.Table(os.environ["DYNAMODB_USERS_TABLE"])
videos_table = dynamodb.Table(os.environ["DYNAMODB_VIDEOS_TABLE"])

# Redis
redis_client = redis.Redis.from_url(
    os.environ["REDIS_URL"], decode_responses=True)

# S3
s3_client = boto3.client("s3", region_name=os.environ["AWS_REGION"])
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]