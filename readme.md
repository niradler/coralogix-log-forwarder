# Forward logs to coralogix 

simple to read coralogix log shipper for aws cloudwatch logs

dont forget to add permissions.

```
aws lambda add-permission --function-name "SERVICE_NAME-STAGE-FUNCTION_NAME" --statement-id "SERVICE_NAME-STAGE-FUNCTION_NAME" --principal "logs.us-east-1.amazonaws.com" --action "lambda:InvokeFunction" --source-arn "arn:aws:logs:us-east-1:ID:log-group:/aws/lambda/STREAM_NAME:*" --source-account "ACCOUNT_ID"
```