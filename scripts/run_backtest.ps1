# 中文说明：开发与运维辅助脚本。

param(
  [string]$WeatherCsv,
  [string]$MarketCsv,
  [string]$Out = "backtest_result.json"
)

python -m backtesting --weather $WeatherCsv --market $MarketCsv --out $Out