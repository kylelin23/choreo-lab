import os
import boto3
from dotenv import load_dotenv

load_dotenv()

dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
users_table = dynamodb.Table(os.environ["DYNAMODB_USERS_TABLE"])
