
SERVICE_NAME="onni-dev"
AWS_REGION="us-west-2"
SERVICE_ID=$(aws apprunner list-services --region "${AWS_REGION}" --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text | awk -F'/' '{print $NF}')
LOG_GROUP="/aws/apprunner/${SERVICE_NAME}/${SERVICE_ID}/application"

echo "Tailing ${LOG_GROUP}"
aws logs tail "${LOG_GROUP}" \
  --region "${AWS_REGION}" \
  --follow \
  --since 1m \
  --format short &
APP_TAIL_PID=$!


cleanup() {
  kill "${APP_TAIL_PID}" 2>/dev/null || true
}
trap cleanup EXIT SIGINT SIGTERM

wait "${APP_TAIL_PID}"